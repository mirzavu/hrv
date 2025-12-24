
import { getAdminPb } from '@/lib/pbAdmin';

async function seedBaseline() {
    try {
        console.log('Authenticating as admin...');
        const pb = await getAdminPb();

        // Get the first baseline record
        console.log('Fetching baseline...');
        const result = await pb.collection('user_baselines').getList(1, 1);

        if (result.items.length === 0) {
            console.error('No baseline found to seed! Please start a session first or check user ID.');
            process.exit(1);
        }

        const baseline = result.items[0];
        console.log(`Found baseline for user ${baseline.user_id} (ID: ${baseline.id})`);

        // Update with mock data
        const updates = {
            lf_power_avg: 600,
            hf_power_avg: 500,
            lf_hf_avg: 1.2,
            amo50_avg: 25
        };

        console.log('Updating baseline with:', updates);

        await pb.collection('user_baselines').update(baseline.id, updates);

        console.log('Successfully seeded baseline data!');
        console.log('You can now check the UI.');

    } catch (error) {
        console.error('Error seeding baseline:', error);
        process.exit(1);
    }
}

seedBaseline();
