// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DownloadWarningModal from '../components/DownloadWarningModal';

// ─── Component Rendering ────────────────────────────────────────────────────

describe('DownloadWarningModal', () => {
  it('renders with correct title and content', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    // Check title
    expect(screen.getByText('Unvalidated File')).toBeInTheDocument();

    // Check main message
    expect(screen.getByText('This file has not been validated.')).toBeInTheDocument();

    // Check detailed description
    expect(screen.getByText(/It may not load as a valid DITA file in Heretto/)).toBeInTheDocument();

    // Check buttons
    expect(screen.getByText('Return to Editor')).toBeInTheDocument();
    expect(screen.getByText('Download Anyway')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'download-warning-title');

    // Check that the title has the correct id
    const title = screen.getByText('Unvalidated File');
    expect(title).toHaveAttribute('id', 'download-warning-title');
  });

  it('displays warning icon', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    // The AlertTriangle icon should be present (testing by the svg element)
    const icon = screen.getByText('Unvalidated File').querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  // ─── User Interaction ───────────────────────────────────────────────────────

  it('calls onCancel when Cancel button is clicked', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const cancelButton = screen.getByText('Return to Editor');
    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockContinue).not.toHaveBeenCalled();
  });

  it('calls onContinue when Continue button is clicked', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const continueButton = screen.getByText('Download Anyway');
    fireEvent.click(continueButton);

    expect(mockContinue).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  // ─── Keyboard Navigation ────────────────────────────────────────────────────

  it('calls onCancel when Escape key is pressed', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    // Find the modal backdrop (the div with keyDown handler)
    const backdrop = screen.getByRole('dialog').parentElement;

    // Simulate Escape key press
    fireEvent.keyDown(backdrop!, { key: 'Escape' });

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockContinue).not.toHaveBeenCalled();
  });

  it('does not trigger callbacks for non-Escape key presses', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const backdrop = screen.getByRole('dialog').parentElement;

    // Try various other keys
    fireEvent.keyDown(backdrop!, { key: 'Enter' });
    fireEvent.keyDown(backdrop!, { key: 'Space' });
    fireEvent.keyDown(backdrop!, { key: 'Tab' });

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockContinue).not.toHaveBeenCalled();
  });

  // ─── Focus Management ───────────────────────────────────────────────────────

  it('has focusable buttons for keyboard navigation', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const cancelButton = screen.getByText('Return to Editor');
    const continueButton = screen.getByText('Download Anyway');

    expect(cancelButton.tagName).toBe('BUTTON');
    expect(continueButton.tagName).toBe('BUTTON');

    // Buttons should be focusable
    cancelButton.focus();
    expect(document.activeElement).toBe(cancelButton);

    continueButton.focus();
    expect(document.activeElement).toBe(continueButton);
  });

  it('supports Enter key on focused buttons', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const cancelButton = screen.getByText('Return to Editor');
    const continueButton = screen.getByText('Download Anyway');

    // Test Enter on cancel button
    cancelButton.focus();
    fireEvent.keyDown(cancelButton, { key: 'Enter' });
    fireEvent.click(cancelButton); // Browser would trigger click on Enter
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // Reset
    mockCancel.mockReset();

    // Test Enter on continue button
    continueButton.focus();
    fireEvent.keyDown(continueButton, { key: 'Enter' });
    fireEvent.click(continueButton); // Browser would trigger click on Enter
    expect(mockContinue).toHaveBeenCalledTimes(1);
  });

  // ─── Styling and Structure ──────────────────────────────────────────────────

  it('has proper modal structure with backdrop', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('rounded-xl', 'shadow-2xl');
  });

  it('has correct button styles for primary and secondary actions', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const cancelButton = screen.getByText('Return to Editor');
    const continueButton = screen.getByText('Download Anyway');

    // Cancel button should have hover-btn class (secondary styling)
    expect(cancelButton).toHaveClass('hover-btn');

    // Continue button should have DITA primary styling
    expect(continueButton).toHaveClass('bg-dita-600', 'hover:bg-dita-500', 'text-white');
  });

  // ─── Multiple Instances ─────────────────────────────────────────────────────

  it('handles multiple callback invocations correctly', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    const cancelButton = screen.getByText('Return to Editor');
    const continueButton = screen.getByText('Download Anyway');

    // Multiple clicks should work
    fireEvent.click(cancelButton);
    fireEvent.click(cancelButton);
    expect(mockCancel).toHaveBeenCalledTimes(2);

    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    expect(mockContinue).toHaveBeenCalledTimes(2);
  });

  it('renders warning content correctly formatted', () => {
    const mockCancel = vi.fn();
    const mockContinue = vi.fn();

    render(<DownloadWarningModal onCancel={mockCancel} onContinue={mockContinue} />);

    // Check that the warning text is properly formatted with correct styling
    const mainText = screen.getByText('This file has not been validated.');
    expect(mainText).toHaveClass('font-medium');

    const detailText = screen.getByText(/It may not load as a valid DITA file/);
    expect(detailText).toHaveClass('text-sm', 'leading-relaxed');
  });
});