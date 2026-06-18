// 모든 최종 값(leaf value)을 유니언으로 뽑아내는 재귀 타입
export type NestedValueOf<T> =
  T extends Record<string, unknown>
    ? NestedValueOf<T[keyof T]> // 각 key에 대해 재귀적으로 탐색
    : T; // 최종 값이면 해당 타입으로 반환
