-- Add the Leave of Absence (LOA) grantee status. LOA is temporary: an LOA
-- grantee can be reinstated to AWARDED (Active). No existing rows change.
-- AlterTable
ALTER TABLE `sponsorshipapplications`
    MODIFY `application_status` ENUM(
        'PENDING_POOLING',
        'FOLLOW_UP',
        'COMPLETE',
        'REJECTED',
        'PENDING_APPLICATION_LIST',
        'PENDING_RANKING_SELECTION',
        'RANKED',
        'NOT_QUALIFIED',
        'AWARDED',
        'DELISTED',
        'GRADUATED',
        'LOA'
    ) NOT NULL;
