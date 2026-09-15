-- Add post-award grantee lifecycle statuses (DELISTED, GRADUATED) to the
-- application_status enum. AWARDED is unchanged and doubles as the "Active"
-- grantee state in the Monitoring List, so no existing rows need migrating.
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
        'GRADUATED'
    ) NOT NULL;
