import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaptureChat from '../CaptureChat.jsx';

vi.mock('../../services/api.js', () => ({
  api: {
    getCaptureMessages: vi.fn(),
    streamCaptureMessage: vi.fn(),
    createIdea: vi.fn(),
    createReminder: vi.fn(),
    suggestReminder: vi.fn(),
  },
}));

vi.mock('../../services/settings.js', () => ({
  getSetting: vi.fn(() => 5),
}));

vi.mock('../../store/useAreaStore.js', () => ({
  useAreaStore: vi.fn(() => ({
    areas: [{ id: '1', name: 'Work' }, { id: '2', name: 'Personal' }],
    setActive: vi.fn(),
  })),
}));

const { api } = await import('../../services/api.js');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getCaptureMessages.mockResolvedValue({ messages: [] });
});

async function renderAndWait(onNavigate = vi.fn()) {
  render(<CaptureChat onNavigate={onNavigate} />);
  // Wait for the initial history load to settle
  await waitFor(() => expect(api.getCaptureMessages).toHaveBeenCalled());
  return screen.getByPlaceholderText(/what's on your mind/i);
}

describe('CaptureChat slash command autocomplete', () => {
  it('/help runs on first Enter without needing a second press', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      // addSystemMsg renders all command descriptions as a single text block
      expect(screen.getByText(/Show all commands/)).toBeInTheDocument();
    });
  });

  it('clears the input after executing /help', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('/ideas navigates on first Enter', async () => {
    const onNavigate = vi.fn();
    const textarea = await renderAndWait(onNavigate);

    fireEvent.change(textarea, { target: { value: '/ideas' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('ideas');
    });
  });

  it('/projects navigates on first Enter', async () => {
    const onNavigate = vi.fn();
    const textarea = await renderAndWait(onNavigate);

    fireEvent.change(textarea, { target: { value: '/projects' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('projects');
    });
  });

  it('/idea (needs args) fills autocomplete instead of executing', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/idea' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // Input should be filled with '/idea ' (trailing space ready for the title arg)
    await waitFor(() => {
      expect(textarea.value).toBe('/idea ');
    });
    expect(api.createIdea).not.toHaveBeenCalled();
  });

  it('/area (needs args) fills autocomplete instead of executing', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/area' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(textarea.value).toBe('/area ');
    });
  });
});

describe('CaptureChat slash command execution', () => {
  it('/idea [title] saves an idea and confirms it', async () => {
    api.createIdea.mockResolvedValue({ id: '42', title: 'My Idea' });
    const textarea = await renderAndWait();

    // No autocomplete because the input has a space
    fireEvent.change(textarea, { target: { value: '/idea My Idea' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(api.createIdea).toHaveBeenCalledWith({ title: 'My Idea' });
      expect(screen.getByText(/Idea saved.*My Idea/i)).toBeInTheDocument();
    });
  });

  it('/note [text] saves a note with the note tag', async () => {
    api.createIdea.mockResolvedValue({ id: '43', title: 'Quick note' });
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/note Quick note' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(api.createIdea).toHaveBeenCalledWith({ title: 'Quick note', tags: ['note'] });
    });
  });

  it('/area switches to a matching area', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/area Work' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText(/Switched to area.*Work/i)).toBeInTheDocument();
    });
  });

  it('/area with unknown name shows available areas', async () => {
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/area Unknown' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('/remind creates a reminder using the AI suggestion', async () => {
    api.suggestReminder.mockResolvedValue({
      message: '{"title":"Call dentist","due_date":"2026-06-01","note":""}',
      questions: [],
    });
    api.createReminder.mockResolvedValue({ id: '1' });
    const textarea = await renderAndWait();

    fireEvent.change(textarea, { target: { value: '/remind call the dentist next month' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(api.createReminder).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Call dentist', due_date: '2026-06-01' })
      );
      expect(screen.getByText(/Reminder set.*Call dentist/i)).toBeInTheDocument();
    });
  });
});
