/**
 * Very rudimentary "overview tracking" abstraction.
 *
 * This is meant to tracking anything that's test-like (i.e. a test suite or a suite of suites)
 *
 * This is mainly meant for us to not have to track math addition in big run loops,
 * but has some strict assurances that make for weird usage.
 *
 * I.e. you can either tally up the total first early and then run tests
 *      or you have to make sure to addToTheTotal first before marking a test so that you don't trigger a "more tests than total error"
 *
 * You also have to finalize() the object before being able to get any of its public fields.
 */
export class TestGroupOverview {
	get passed() {
		this.ensureFinalized();
		return this._passed;
	}
	get failed() {
		this.ensureFinalized();
		return this._failed;
	}
	get notReached() {
		this.ensureFinalized();
		return this._notReached;
	}
	get skipped() {
		this.ensureFinalized();
		return this._skipped;
	}
	get total() {
		this.ensureFinalized();
		return this._total;
	}
	get time() {
		this.ensureFinalized();
		return this._time;
	}
	private _passed = 0;
	private _failed = 0;
	private _notReached = 0;
	private _skipped = 0;
	private _total = 0;
	private _start: Date | undefined;
	private _time: number = 0;
	private _finalized = false;

	addToTotal(n: number) {
		this.ensureNotFinalized();
		this._total += n;
	}

	startTime() {
		if (this._start) {
			throw new Error("Can only start time once!");
		}
		this._start = new Date();
	}

	pass(n: number) {
		this.ensureNotFinalized();
		this._passed += n;
		this.ensureNoMonkeyBusiness();
	}

	fail(n: number) {
		this.ensureNotFinalized();
		this._failed += n;
		this.ensureNoMonkeyBusiness();
	}

	skip(n: number) {
		this.ensureNotFinalized();
		this._skipped += n;
		this.ensureNoMonkeyBusiness();
	}

	private ensureNoMonkeyBusiness() {
		const sum = this._failed + this._passed + this._skipped;
		if (sum > this._total) {
			throw new Error(
				`Unexpected condition when recording tests! Total of skipped + failed + pass is greater than total: ${this._total}`,
			);
		}
	}

	private ensureFinalized() {
		if (!this._finalized) {
			throw new Error(
				"Must finalize an overview before retrieving its values!",
			);
		}
	}

	private ensureNotFinalized() {
		if (this._finalized) {
			throw new Error("Overview has already been finalized!  Cannot change!");
		}
	}

	finalize() {
		if (this._finalized) {
			return;
		}
		if (this._start) {
			this._time = new Date().getTime() - this._start.getTime();
		}
		this._notReached =
			this._total - (this._failed + this._passed + this._skipped);
		this._finalized = true;
	}
}
