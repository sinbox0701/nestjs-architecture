import { R } from '@/common/base/response';

describe('unit smoke', () => {
  it('runs basic assertions without I/O', () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves @/ path alias and swc transform via R.empty()', () => {
    expect(R.empty()).toEqual({ success: true });
  });
});
