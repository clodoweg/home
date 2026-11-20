import { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class SummaryReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private timedOut = 0;

  onTestEnd(_test: TestCase, result: TestResult) {
    if (result.status === 'passed') this.passed++;
    else if (result.status === 'failed') this.failed++;
    else if (result.status === 'skipped') this.skipped++;
    else if (result.status === 'timedOut') this.timedOut++;
  }

  async onEnd(_result: FullResult) {
    const total = this.passed + this.failed + this.skipped + this.timedOut;

    console.log('\n' + '='.repeat(40));
    console.log('       🧪 FINAL TEST SUMMARY (WEB)');
    console.log('='.repeat(40));
    console.log(` ✅ Passed:   ${this.passed}`);
    console.log(` ❌ Failed:   ${this.failed + this.timedOut}`);
    if (this.skipped > 0) console.log(` ⏭️  Skipped:  ${this.skipped}`);
    if (this.timedOut > 0) console.log(` ⏰ Timeout:  ${this.timedOut}`);
    console.log('-'.repeat(40));
    console.log(` 📊 Total:    ${total}`);
    console.log('='.repeat(40) + '\n');
  }
}

export default SummaryReporter;
