/** 팀별 인원 집계(로스터) 응답. Kysely ReadModel 집계 결과 1행. */
export class TeamRosterData {
  /** 소속팀 ID */
  teamId!: number;
  /** 소속팀 이름 */
  teamName!: string;
  /** 소속팀이 속한 역할(Role) 이름 (예: "BLUE") */
  roleName!: string;
  /** 활성 멤버 수 */
  memberCount!: number;
  /** 활성 팀장(LEADER) 수 */
  leaderCount!: number;
}
