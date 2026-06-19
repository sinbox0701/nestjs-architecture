import { IsString, MaxLength, MinLength } from 'class-validator';

/** 역할 생성 요청. name이 식별자 겸 Tier1 매트릭스 키. (응답은 `RoleData`) */
export class CreateRoleRequest {
  /** 역할 이름(식별자) @example "BLUE" */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}
