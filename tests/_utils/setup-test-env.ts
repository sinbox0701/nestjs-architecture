import { config } from 'dotenv';
// 통합/E2E 테스트는 도커 밖(호스트)에서 실행되므로 localhost 기반 .env.test 를 최우선 주입한다.
config({ path: '.env.test', override: true });
