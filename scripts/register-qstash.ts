import { QstashService } from '../src/integrations/qstash/qstash.service';

new QstashService().registerSchedule().then(
  (id) => console.log('QStash reconciliation schedule:', id),
  () => {
    console.error('QStash schedule registration failed');
    process.exitCode = 1;
  },
);
