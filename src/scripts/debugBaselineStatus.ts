
import getAdminPb from '../lib/pbAdmin';

async function debugBaselineStatus() {
    const pb = await getAdminPb();
    const email = 'mirza.ekm@gmail.com';

    try {
        const user = await pb.collection('users').getFirstListItem(`email="${email}"`);
        console.log(`User ID: ${user.id}`);

        // Check sessions
        const sessions = await pb.collection('sessions').getFullList({
            filter: `userId="${user.id}"`,
            sort: '-startTime'
        });

        console.log(`Total Sessions: ${sessions.length}`);

        const uniqueDays = new Set(sessions.map(s => {
            const d = new Date(s.startTime);
            return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        }));

        console.log(`Unique Days Count: ${uniqueDays.size}`);
        console.log('Unique Days:', Array.from(uniqueDays));

        // Check baseline record
        try {
            const baseline = await pb.collection('user_baselines').getFirstListItem(`user_id="${user.id}"`);
            console.log('Baseline Record Found:');
            console.log(`- Established: ${baseline.established}`);
            console.log(`- Sessions Used: ${baseline.sessions_count}`);
            console.log(`- Last Updated: ${baseline.last_updated}`);
            console.log(`- RMSSD: Avg=${baseline.rmssd_avg}, Stdev=${baseline.rmssd_stdev}`);
            console.log(`- SDNN: Avg=${baseline.sdnn_avg}, Stdev=${baseline.sdnn_stdev}`);
            console.log(`- HR: Avg=${baseline.hr_avg}, Stdev=${baseline.hr_stdev}`);
        } catch (e: any) {
            if (e.status === 404) {
                console.log('No baseline record exists for this user.');
            } else {
                throw e;
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

debugBaselineStatus();
