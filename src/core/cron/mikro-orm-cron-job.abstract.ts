import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { MikroORM, RequestContext } from '@mikro-orm/core';

import { CronJobAbstract } from './cron-job.abstract';

/**
 * MikroORM을 사용하는 Cron Job을 위한 Abstract
 *
 * MikroORM EntityManager가 필요한 작업에만 이 클래스를 상속받으세요.
 * 일반 Cron Job은 CronJobAbstract를 계속 사용하면 됩니다.
 *
 * 이 클래스는 자동으로 RequestContext를 생성하여 MikroORM의
 * global EntityManager 에러를 방지합니다.
 */
export abstract class MikroOrmCronJobAbstract extends CronJobAbstract {
  protected constructor(
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected readonly orm: MikroORM,
    protected readonly cronExpression: string = CronExpression.EVERY_MINUTE,
    protected readonly withoutOverlapping: boolean = true,
  ) {
    super(schedulerRegistry, cronExpression, withoutOverlapping);
  }

  /**
   * 자식 클래스가 구현할 메서드
   * 이 메서드는 이미 RequestContext 안에서 실행되므로
   * MikroORM Repository를 안전하게 사용할 수 있습니다.
   */
  protected abstract handleJobWithContext(): Promise<void>;

  /**
   * 부모의 handleJob을 오버라이드하여 RequestContext 제공
   * @override
   */
  protected async handleJob(): Promise<void> {
    await RequestContext.create(this.orm.em, async () => {
      await this.handleJobWithContext();
    });
  }
}
