import { ApiProperty } from '@nestjs/swagger';

export class SuccessEnvelope {
  @ApiProperty({ example: true })
  success: boolean = true;
}

export class ListMeta {
  @ApiProperty({ example: 5 })
  count!: number;
}

export class PageMeta {
  @ApiProperty({ example: 5 })
  count!: number;
}

export class CursorMeta {
  @ApiProperty({ example: 'eyJpZCI6MTAwfQ==', required: false })
  nextPageCursor?: string;
}
