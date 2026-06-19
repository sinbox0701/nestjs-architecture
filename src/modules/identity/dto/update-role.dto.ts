import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 역할 수정 요청. */
export class UpdateRoleRequest {
  /** 역할 이름(식별자) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;
}
