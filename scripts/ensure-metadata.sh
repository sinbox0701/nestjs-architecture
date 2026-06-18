#!/bin/sh

# Swagger 플러그인용 metadata.ts를 빈 템플릿으로 초기화.
# 이전 빌드의 stale 메타데이터가 남아있으면 타입 에러를 유발하므로 매번 리셋한다.
# generate-metadata.ts 가 이어서 실제 메타데이터로 덮어쓴다.
METADATA_FILE="src/metadata.ts"

cat > "$METADATA_FILE" << 'EOF'
/* eslint-disable */
export default async () => {
  return { '@nestjs/swagger': { models: [], controllers: [] } };
};
EOF
echo "✓ metadata.ts reset"
