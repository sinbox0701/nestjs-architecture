# 로컬 개발용 이미지. docker compose의 app 서비스가 사용한다.
# 소스는 볼륨 마운트로 핫리로드(start:dev)하고, node_modules는 컨테이너 것을 유지한다.
FROM node:24-slim

# 네이티브 모듈(argon2 등) 빌드 폴백용 도구. prebuilt가 있으면 사용 안 됨.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# 의존성 레이어 캐시: lockfile만 먼저 복사해 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# 기본은 dev watch. compose에서 command로 덮어쓸 수 있다.
CMD ["pnpm", "start:dev"]
