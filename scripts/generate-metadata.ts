// @nestjs/swagger CLI 플러그인 메타데이터 생성기.
//
// SWC 빌드는 tsc transformer(@nestjs/swagger nest-cli plugin)를 못 쓰므로,
// 빌드/기동 전에 이 스크립트로 src/metadata.ts를 생성한다. 이 메타데이터가 있어야
// - controller JSDoc 첫 줄 → OpenAPI operation summary
// - DTO 필드 타입/JSDoc → 스키마(@ApiProperty 수동 선언 없이)
// 가 Swagger 문서에 반영되고, 프론트 orval 코드젠이 타입/설명을 뽑을 수 있다.
//
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
