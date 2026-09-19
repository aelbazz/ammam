import { Module } from '@nestjs/common';
import { ContactSubmissionController } from './contact-submission.controller';
import { ContactSubmissionService } from './contact-submission.service';
import { SpamGuardService, HeuristicSpamGuardService } from './spam-guard.service';

@Module({
  controllers: [ContactSubmissionController],
  providers: [
    ContactSubmissionService,
    { provide: SpamGuardService, useClass: HeuristicSpamGuardService },
  ],
})
export class ContactSubmissionModule {}
