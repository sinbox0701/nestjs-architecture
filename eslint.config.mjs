import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  ...tseslint.configs.recommended,
  prettierConfig,

  // ── 기본 룰 (전체 *.ts) ──
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'warn',

      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // ── console.log 차단: FrameworkLogger 사용 강제 ──
      // 부트스트랩 실패 등 logger 초기화 이전 경로의 console.error만 허용한다.
      // 참조: docs/convention/06-naming-and-style.md
      'no-console': ['error', { allow: ['error'] }],

      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            ['^node:'],
            ['^@nestjs', '^@mikro-orm'],
            ['^@?\\w'],
            ['^@/'],
            ['^@shared/', '^@lib/'],
            ['^\\.\\./'],
            ['^\\./', '^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'warn',

      // ── Rule 3b: @mikro-orm/decorators (non-legacy) import 금지 ──
      // v7에서는 @mikro-orm/decorators/legacy를 사용해야 한다.
      // 참조: docs/convention/04-layer-responsibility.md
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mikro-orm/decorators',
              message:
                '@mikro-orm/decorators 대신 @mikro-orm/decorators/legacy를 사용하세요. 참조: docs/convention/04-layer-responsibility.md',
            },
          ],
        },
      ],

      // ── Rule 4: unwrap() 사용 경고 ──
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='unwrap']",
          message:
            'unwrap() 사용을 지양하세요. PK만 필요하면 ref.id, 필드가 필요하면 getEntity()를 사용하세요. 참조: docs/convention/04-layer-responsibility.md',
        },
      ],
    },
  },

  // ── Rule 1: Exception factory 사용 강제 (service/handler만) ──
  {
    files: ['**/*.service.ts', '**/*.handler.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='HttpException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='BadRequestException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='NotFoundException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='ForbiddenException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='UnauthorizedException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='ConflictException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "CallExpression[callee.property.name='unwrap']",
          message: 'unwrap() 사용을 지양하세요. PK만 필요하면 ref.id, 필드가 필요하면 getEntity()를 사용하세요.',
        },
      ],
    },
  },

  // ── Rule 1 + Rule 2: Controller 전용 ──
  {
    files: ['**/*.controller.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.type='ThisExpression'][property.name=/.*[Rr]epo(sitory)?$/]",
          message: 'Controller에서 Repository 직접 호출 금지. Service를 통해 접근하세요.',
        },
        {
          selector: "NewExpression[callee.name='HttpException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='BadRequestException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='NotFoundException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='ForbiddenException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='UnauthorizedException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "NewExpression[callee.name='ConflictException']",
          message: '인라인 예외 생성 금지. exception/ 폴더의 예외 팩토리를 사용하세요.',
        },
        {
          selector: "CallExpression[callee.property.name='unwrap']",
          message: 'unwrap() 사용을 지양하세요.',
        },
      ],
    },
  },

  // ── Rule 5: @ApiProperty 금지 (DTO 파일만) ──
  {
    files: ['**/*.dto.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Decorator[expression.callee.name='ApiProperty']",
          message:
            '@ApiProperty() 사용을 지양하세요. class-validator 데코레이터와 JSDoc을 사용하세요. 참조: docs/convention/06-naming-and-style.md',
        },
        {
          selector: "CallExpression[callee.property.name='unwrap']",
          message: 'unwrap() 사용을 지양하세요.',
        },
      ],
    },
  },

  // ── Rule 3a: EntityManager/FilterQuery는 @mikro-orm/postgresql에서 import ──
  {
    files: ['**/*.ts'],
    ignores: ['**/seed/**', '**/setup.ts', '**/run-migrations.ts', '**/migration-baseline.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mikro-orm/decorators',
              message: '@mikro-orm/decorators 대신 @mikro-orm/decorators/legacy를 사용하세요.',
            },
            {
              name: '@mikro-orm/core',
              importNames: ['EntityManager', 'FilterQuery'],
              message: 'EntityManager, FilterQuery는 @mikro-orm/postgresql에서 import하세요.',
            },
          ],
        },
      ],
    },
  },

  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'src/metadata.ts'],
  },
];
