const prisma = require('./db');

async function resetDatabase() {
  console.log('🔄 Wiping all data from SitePulse database...');

  try {
    // Delete in cascade/foreign-key dependency order
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`Deleted ${deletedMessages.count} messages`);

    const deletedConversations = await prisma.conversation.deleteMany({});
    console.log(`Deleted ${deletedConversations.count} conversations`);

    const deletedFeedback = await prisma.feedback.deleteMany({});
    console.log(`Deleted ${deletedFeedback.count} feedbacks`);

    const deletedBugs = await prisma.bugReport.deleteMany({});
    console.log(`Deleted ${deletedBugs.count} bug reports`);

    const deletedAnalytics = await prisma.analyticsEvent.deleteMany({});
    console.log(`Deleted ${deletedAnalytics.count} analytics events`);

    const deletedSites = await prisma.site.deleteMany({});
    console.log(`Deleted ${deletedSites.count} sites`);

    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`Deleted ${deletedUsers.count} users`);

    console.log('✨ All database records have been successfully deleted. Database is completely fresh!');
  } catch (err) {
    console.error('❌ Failed to reset database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
