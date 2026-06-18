import * as argon2 from 'argon2';

/**
 * 패스워드 해싱 유틸리티
 *
 * Argon2id 알고리즘을 사용한 패스워드 해싱 및 검증
 * - 메모리: 64 MiB
 * - 반복 횟수: 3
 * - 병렬 처리: 4 스레드
 */
export class PasswordUtil {
  /**
   * 패스워드 해싱 (Argon2id)
   *
   * @param password 평문 패스워드
   * @returns 해싱된 패스워드
   */
  static async hash(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * 패스워드 검증 (Argon2)
   *
   * @param hashed 해싱된 패스워드
   * @param plain 평문 패스워드
   * @returns 일치 여부
   */
  static async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
