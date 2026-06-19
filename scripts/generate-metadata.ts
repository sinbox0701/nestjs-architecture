// @nestjs/swagger CLI 플러그인 메타데이터 생성기.
//
// SWC 빌드는 tsc transformer(@nestjs/swagger nest-cli plugin)를 못 쓰므로,
// 빌드/기동 전에 이 스크립트로 src/metadata.ts를 생성한다. 이 메타데이터가 있어야
// - controller JSDoc 첫 줄 → OpenAPI operation summary
// - DTO 필드 타입/JSDoc → 스키마(@ApiProperty 수동 선언 없이)
// 가 Swagger 문서에 반영되고, 프론트 orval 코드젠이 타입/설명을 뽑을 수 있다.
//
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PluginMetadataGenerator } = require('@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator');
// @nestjs/swagger 11.4+ 는 ReadonlyVisitor를 공개 서브패스 '/plugin'으로 노출한다.
// (이전 버전의 deep import '@nestjs/swagger/dist/...' 경로는 exports 제한으로 막힘)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ReadonlyVisitor } = require('@nestjs/swagger/plugin');

const generator = new PluginMetadataGenerator();
generator.generate({
  visitors: [
    new ReadonlyVisitor({
      // controller 메서드 위 JSDoc 첫 줄을 operation summary로 사용한다.
      introspectComments: true,
      controllerKeyOfComment: 'summary',
      // class-validator 데코레이터를 스키마 제약으로 반영한다.
      classValidatorShim: true,
      // DTO로 인식할 파일 접미사. 도메인은 번들 .dto.ts, 공통 쿼리 베이스는 .query.ts.
      // (.request.ts/.response.ts 분리는 컨벤션상 금지이므로 포함하지 않는다.)
      dtoFileNameSuffix: ['.dto.ts', '.query.ts'],
      pathToSource: path.join(process.cwd(), 'src'),
    }),
  ],
  outputDir: path.join(process.cwd(), 'src'),
  tsconfigPath: 'tsconfig.json',
  filename: 'metadata.ts',
  printDiagnostics: true,
});

// ── 후처리: enum 프로퍼티에 enumName 주입 ──────────────────────────────────
//
// ReadonlyVisitor는 enum 필드를 `enum: t["...path"].TeamPosition` 형태로만 emit하고
// enumName을 넣지 않는다. enumName이 없으면 @nestjs/swagger가 enum 값을 각 스키마에
// inline으로 복제하므로, orval이 같은 enum을 프로퍼티마다 별도 타입(예:
// CreateUserRequestPosition, UpdateUserRequestPosition...)으로 생성한다.
//
// 여기서 각 enum 참조의 마지막 식별자(enum 이름)를 뽑아 enumName으로 주입하면
// swagger가 enum을 components.schemas.<EnumName>으로 추출(`$ref` 공유)하고,
// orval은 공유 enum 타입 하나만 생성한다. 도메인 DTO는 @IsEnum + JSDoc만 쓰면 되고
// 수동 @ApiProperty 선언은 불필요하다(컨벤션 유지).
const metadataPath = path.join(process.cwd(), 'src', 'metadata.ts');
const metadataSource = fs.readFileSync(metadataPath, 'utf8');

// `enum: t["<path>"].<Name>` 매칭. 바로 뒤에 enumName이 이미 있으면 건너뛴다(멱등).
const enumRefPattern = /enum:\s*t\[(?<path>[^\]]+)\]\.(?<name>[A-Za-z0-9_$]+)(?!\s*,\s*enumName)/g;

// 같은 enum 이름이 서로 다른 파일에서 나오면 OpenAPI 컴포넌트가 충돌하므로 감지해 경고한다.
const nameToPaths = new Map<string, Set<string>>();
let injectedCount = 0;
const patchedSource = metadataSource.replace(enumRefPattern, (match: string, refPath: string, refName: string) => {
  if (!nameToPaths.has(refName)) nameToPaths.set(refName, new Set());
  nameToPaths.get(refName)!.add(refPath);
  injectedCount += 1;
  return `${match}, enumName: "${refName}"`;
});

const collisions = [...nameToPaths.entries()].filter(([, paths]) => paths.size > 1);
if (collisions.length > 0) {
  for (const [name, paths] of collisions) {
    // eslint-disable-next-line no-console
    console.warn(
      `[generate-metadata] enum 이름 충돌: "${name}" 가 여러 파일에서 사용됨 → ${[...paths].join(', ')}. ` +
        'OpenAPI 컴포넌트가 병합되어 잘못된 스키마가 될 수 있다. enum 이름을 유일하게 만들 것.',
    );
  }
}

fs.writeFileSync(metadataPath, patchedSource);

// eslint-disable-next-line no-console
console.log(`[generate-metadata] enumName 주입 완료: ${injectedCount}개 enum 참조 (고유 enum ${nameToPaths.size}종).`);
