# Alibaba Cloud OSS Sync Storage

Sync your Tau notes, conversations, and attachments to Alibaba Cloud OSS, so you can access the same library across desktop and mobile devices. Private buckets work out of the box without enabling public access.

## Getting Started

1. Install **Alibaba Cloud OSS Sync Storage** from the Plugin Center, then enable it under **Installed** on the Plugins page.
2. Open **Settings** on the plugin details page.
3. Fill in **AccessKey ID**, **AccessKey Secret**, **Bucket**, and **Region** (for example, `oss-cn-hangzhou`). Leave **Directory** empty to use the root directory.
4. Save and test the connection, then go to **Settings → Sync** and select this service to check status, upload, download, or enable automatic sync. Saving settings does not automatically switch your active sync service.

## FAQ

**Permission denied or network error?** Check that your AccessKey has read and write permissions for the bucket and that **Region** is entered correctly, then try again.

**Incompatible bucket versioning settings?** Check the bucket's versioning configuration in the Alibaba Cloud console. To protect your data from being overwritten, sync stops automatically instead of forcing a write when a conflict is detected.

**Can multiple libraries share the same storage location?** No. Use a separate storage location for each library (you can separate them using **Directory**), otherwise data will overwrite each other.

**Does disabling the plugin delete my data?** No. Both your settings and synced data stay intact and work again once you re-enable the plugin. You cannot disable or uninstall the plugin while a sync is in progress; wait until it finishes first.

## Notes

- Works on desktop and mobile. If you also use the asset upload plugin, sync and upload credentials are configured separately and do not affect each other.
- Your AccessKey is the key to your account. Never share it with others or include it in screenshots or issue reports.
