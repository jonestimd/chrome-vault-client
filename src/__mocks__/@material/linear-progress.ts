
class MockProgress {
    readonly root = {
        getAttribute: jest.fn(),
    };
    readonly setProgress = jest.fn();
    readonly open = jest.fn();
    readonly close = jest.fn();

    set progress(value: number) {
        this.setProgress(value);
    }
}

export const MDCLinearProgress = MockProgress;