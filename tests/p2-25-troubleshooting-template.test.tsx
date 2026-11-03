// @vitest-environment jsdom
//
// P2-25 slice 2 — Troubleshooting as the fourth New Topic option. Slice 1
// (parser/serializer/validation, ADR-009) already shipped in v0.9.7; this
// slice is the template itself: DITA_TOPIC_TYPE widened, a real template
// (empty title/shortdesc per FR-049; a condition and a troubleSolution with
// cause + remedy <steps-unordered> for the body, matching real Heretto
// troubleshooting topics), and every place that switched on the 3-value
// union audited so a 4th value doesn't crash or corrupt.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DITA_TOPIC_TYPE,
  DITA_TEMPLATES,
  DITA_PLACEHOLDER_TITLES,
  DITA_PLACEHOLDER_SHORTDESCS,
} from '../constants/dita';
import { validateContentModel } from '../lib/content-model-validate';
import { withUpdatedTopicId } from '../lib/xml-utils';
import { roundTrip } from './helpers/createTestEditor';
import { TopicTypeModal } from '../components/TopicTypeModal';

describe('DITA_TOPIC_TYPE includes troubleshooting', () => {
  it('has exactly 4 members, troubleshooting last', () => {
    expect(DITA_TOPIC_TYPE).toEqual(['task', 'concept', 'reference', 'troubleshooting']);
  });
});

describe('the troubleshooting template', () => {
  const xml = DITA_TEMPLATES.troubleshooting;

  it('has an empty <title/> and <shortdesc/> (FR-049)', () => {
    expect(xml).toContain('<title/>');
    expect(xml).toContain('<shortdesc/>');
  });

  it('declares the troubleshooting DOCTYPE and root', () => {
    expect(xml).toContain('<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">');
    expect(xml).toMatch(/<troubleshooting id="new_troubleshooting">/);
  });

  it('has a condition, and a troubleSolution with cause and remedy', () => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('troublebody > condition')).not.toBeNull();
    expect(doc.querySelector('troublebody > troubleSolution > cause')).not.toBeNull();
    expect(doc.querySelector('troublebody > troubleSolution > remedy')).not.toBeNull();
  });

  it('the remedy uses <steps-unordered> (the shape real Heretto troubleshooting topics use)', () => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const remedy = doc.querySelector('remedy');
    expect(remedy?.querySelector('steps-unordered > step > cmd')).not.toBeNull();
  });

  it('validates clean against the DITA content model (ADR-014)', () => {
    expect(validateContentModel(xml)).toEqual([]);
  });

  it('round-trips byte-stable (an unedited save sends exactly this)', () => {
    expect(roundTrip(xml).replace(/\s+$/, '')).toBe(xml.replace(/\s+$/, ''));
  });
});

describe('troubleshooting placeholder prompts (FR-049 type-awareness)', () => {
  it('has its own title and shortdesc prompts, distinct from the other three', () => {
    expect(DITA_PLACEHOLDER_TITLES.troubleshooting).toBeTruthy();
    expect(DITA_PLACEHOLDER_SHORTDESCS.troubleshooting).toBeTruthy();
    const otherTitles = [DITA_PLACEHOLDER_TITLES.task, DITA_PLACEHOLDER_TITLES.concept, DITA_PLACEHOLDER_TITLES.reference];
    expect(otherTitles).not.toContain(DITA_PLACEHOLDER_TITLES.troubleshooting);
  });
});

describe('withUpdatedTopicId recognizes a troubleshooting default id', () => {
  it('replaces new_troubleshooting with the given id', () => {
    const xml = '<troubleshooting id="new_troubleshooting"><title>Why it fails</title></troubleshooting>';
    expect(withUpdatedTopicId(xml, 'why_it_fails')).toContain('id="why_it_fails"');
  });

  it('leaves a customized id untouched', () => {
    const xml = '<troubleshooting id="already-named"><title>X</title></troubleshooting>';
    expect(withUpdatedTopicId(xml, 'something_else')).toContain('id="already-named"');
  });
});

describe('TopicTypeModal', () => {
  it('shows all four types by default (the New Topic use)', () => {
    render(<TopicTypeModal title="New Topic" description="d" onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText('task')).toBeInTheDocument();
    expect(screen.getByText('concept')).toBeInTheDocument();
    expect(screen.getByText('reference')).toBeInTheDocument();
    expect(screen.getByText('troubleshooting')).toBeInTheDocument();
  });

  it('restricts to the given types (the Convert Topic Type use — troubleshooting is deliberately not a conversion target)', () => {
    render(
      <TopicTypeModal
        title="Convert Topic Type"
        description="d"
        types={['task', 'concept', 'reference']}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('task')).toBeInTheDocument();
    expect(screen.getByText('concept')).toBeInTheDocument();
    expect(screen.getByText('reference')).toBeInTheDocument();
    expect(screen.queryByText('troubleshooting')).not.toBeInTheDocument();
  });

  it('calls onSelect with the clicked type', () => {
    const onSelect = vi.fn();
    render(<TopicTypeModal title="New Topic" description="d" onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(screen.getByText('troubleshooting'));
    expect(onSelect).toHaveBeenCalledWith('troubleshooting');
  });
});
