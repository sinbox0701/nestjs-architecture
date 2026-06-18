export interface PageInput<T> {
  list: T[];
  count: number;
}

export interface CursorPageInput<T> {
  list: T[];
  /** 다음 페이지가 없으면 생략한다(`| null` 대신 키 미노출 — 07-naming-and-style.md). */
  nextPageCursor?: string;
}

export class R {
  static data<T>(data: T) {
    return { success: true as const, data };
  }

  static list<T>(list: T[]) {
    return {
      success: true as const,
      data: {
        list: list,
        count: list.length,
      },
    };
  }

  static page<T>(input: PageInput<T>) {
    return {
      success: true as const,
      data: {
        list: input.list,
        count: input.count,
      },
    };
  }

  static cursorPage<T>(input: CursorPageInput<T>) {
    const data: { list: T[]; nextPageCursor?: string } = { list: input.list };
    // 다음 페이지가 없으면 키 자체를 노출하지 않는다(| null 금지).
    if (input.nextPageCursor !== undefined) {
      data.nextPageCursor = input.nextPageCursor;
    }
    return { success: true as const, data };
  }

  static empty() {
    return { success: true as const };
  }
}
