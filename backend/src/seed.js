const prisma = require('./db');

async function seed() {
  try {
    const existing = await prisma.site.findUnique({
      where: { apiKey: 'sp_demo_12345' }
    });

    if (!existing) {
      const site = await prisma.site.create({
        data: {
          name: 'Demo Website',
          domain: 'localhost',
          apiKey: 'sp_demo_12345',
          widgetSettings: {
            primaryColor: '#2563eb',
            title: 'SitePulse Support',
            subtitle: 'We are here to help!',
            greeting: 'Hi there! How can we help you today?',
            position: 'right',
            enableChat: true,
            enableFeedback: true,
            enableBugReport: true,
            requireEmail: false
          }
        }
      });
      console.log('✅ Demo Site seeded successfully! Site Key: sp_demo_12345');
    } else {
      console.log('ℹ️ Demo Site already exists with key: sp_demo_12345');
    }
  } catch (err) {
    console.error('Error seeding demo site:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
