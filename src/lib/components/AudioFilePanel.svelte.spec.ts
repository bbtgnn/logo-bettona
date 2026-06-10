import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const animApi = vi.hoisted(() => ({
	animationState: { isPlaying: false, audioSource: 'file' as const },
	togglePlay: vi.fn(),
	audioSource: {
		loadFile: vi.fn(async () => {}),
		clearFile: vi.fn(),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		getPeaks: vi.fn(() => [] as { min: number; max: number }[]),
		getDuration: vi.fn(() => 0),
		getFileName: vi.fn(() => null as string | null),
		getCurrentTime: vi.fn(() => 0),
		seek: vi.fn(),
		setRegion: vi.fn(),
		getRegion: vi.fn(() => ({ start: 0, end: 0 })),
		setLoopRegion: vi.fn(),
		isLoopRegion: vi.fn(() => false),
		readLevel: vi.fn(() => 0)
	}
}));

vi.mock('$lib/state/animation', () => animApi);

import AudioFilePanel from './AudioFilePanel.svelte';

describe('AudioFilePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		animApi.animationState.isPlaying = false;
		animApi.audioSource.getFileName.mockReturnValue(null);
		animApi.audioSource.getDuration.mockReturnValue(0);
		animApi.audioSource.getPeaks.mockReturnValue([]);
	});

	it('shows drop zone with "browse" affordance when no file loaded', async () => {
		render(AudioFilePanel);
		await expect.element(page.getByText(/drop audio file|browse/i)).toBeInTheDocument();
	});

	it('file input calls loadFile when a file is selected', async () => {
		render(AudioFilePanel);
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(fileInput).toBeTruthy();
		const fakeFile = new File([''], 'bettona.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });
		fileInput.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(animApi.audioSource.loadFile).toHaveBeenCalledWith(fakeFile));
	});

	it('shows filename and duration once file is loaded', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(12.4);
		render(AudioFilePanel);
		await expect.element(page.getByText('bettona.mp3')).toBeInTheDocument();
		await expect.element(page.getByText(/12\.4\s*s/)).toBeInTheDocument();
	});

	it('reveals loaded state after loadFile resolves (no remount)', async () => {
		// getFileName starts null; loadFile flips it to a name, mimicking the real
		// closure-backed source. The loaded UI must appear without re-rendering.
		animApi.audioSource.loadFile.mockImplementation(async () => {
			animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
			animApi.audioSource.getDuration.mockReturnValue(7.7);
		});
		render(AudioFilePanel);
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		const fakeFile = new File([''], 'bettona.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });
		fileInput.dispatchEvent(new Event('change', { bubbles: true }));
		await expect.element(page.getByText('bettona.mp3')).toBeInTheDocument();
	});

	it('Play calls audioSource.play() and togglePlay when not already playing', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /^play$/i }));
		expect(animApi.audioSource.play).toHaveBeenCalledOnce();
		expect(animApi.togglePlay).toHaveBeenCalledOnce();
	});

	it('Pause calls audioSource.pause() and togglePlay when already playing', async () => {
		animApi.animationState.isPlaying = true;
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /pause/i }));
		expect(animApi.audioSource.pause).toHaveBeenCalledOnce();
		expect(animApi.togglePlay).toHaveBeenCalledOnce();
	});

	it('loop toggle calls setLoopRegion with toggled value', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		const checkbox = page.getByRole('checkbox', { name: /loop/i });
		await userEvent.click(checkbox);
		expect(animApi.audioSource.setLoopRegion).toHaveBeenCalledWith(true);
	});

	it('Remove calls clearFile', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /remove/i }));
		expect(animApi.audioSource.clearFile).toHaveBeenCalledOnce();
	});
});
