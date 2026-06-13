import { describe, it, expect } from 'vitest';
import { mergeTransactions } from '@/features/sync/merge';
import type { Transaction } from '@/types/transaction';

describe('mergeTransactions', () => {
  it('should return local transactions when remote is empty', () => {
    const local: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T10:00:00Z', deleted: false }
    ];
    
    const result = mergeTransactions(local, []);
    
    expect(result.mergedTransactions).toHaveLength(1);
    expect(result.hasChanges).toBe(false);
  });

  it('should pick the transaction with newer updatedAt (Last-Write-Wins)', () => {
    const local: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T11:00:00Z', deleted: false }
    ];
    const remote: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 60000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T12:00:00Z', deleted: false }
    ];

    const result = mergeTransactions(local, remote);
    
    expect(result.mergedTransactions[0].amount).toBe(60000);
    expect(result.mergedTransactions[0].updatedAt).toBe('2026-05-30T12:00:00Z');
    expect(result.hasChanges).toBe(true);
  });

  it('should handle soft-deleted transactions correctly', () => {
    const local: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T12:00:00Z', deleted: true }
    ];
    const remote: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T10:00:00Z', deleted: false }
    ];

    const result = mergeTransactions(local, remote);
    
    expect(result.mergedTransactions[0].deleted).toBe(true);
    expect(result.hasChanges).toBe(false); // Local is already newer, no need to update store
  });

  it('should add new transactions from remote', () => {
    const local: Transaction[] = [
      { id: 'tx1', type: 'expense', amount: 50000, category: 'Food', date: '2026-05-30', createdAt: '2026-05-30T10:00:00Z', updatedAt: '2026-05-30T10:00:00Z', deleted: false }
    ];
    const remote: Transaction[] = [
      { id: 'tx2', type: 'income', amount: 100000, category: 'Salary', date: '2026-05-31', createdAt: '2026-05-31T09:00:00Z', updatedAt: '2026-05-31T09:00:00Z', deleted: false }
    ];

    const result = mergeTransactions(local, remote);
    
    expect(result.mergedTransactions).toHaveLength(2);
    expect(result.hasChanges).toBe(true);
    expect(result.mergedTransactions.find(t => t.id === 'tx2')).toBeDefined();
  });
});
