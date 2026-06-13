import { describe, it, expect } from 'vitest';
import { mergeTransactions } from '@/features/sync/merge';
import type { Transaction } from '@/types/transaction';

// This test file demonstrates the expected TDD flow.
// Tests should be written and approved BEFORE implementing mergeTransactions.

describe('mergeTransactions', () => {
  it('should return local transactions when remote is empty', () => {
    const local: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T10:00:00Z', deleted: false }
    ];
    
    const result = mergeTransactions(local, []);
    
    expect(result.mergedTransactions).toHaveLength(1);
    expect(result.hasChanges).toBe(false);
  });

  // More tests will be added during RED phase:
  // - New remote transaction should be merged
  // - Newer updatedAt should win
  // - Soft delete handling
  // - Conflict detection (future)
});
