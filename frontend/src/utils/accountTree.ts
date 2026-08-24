import type { DataNode } from 'antd/es/tree';
import type { Account } from '../types';

export interface AccountTreeNode extends DataNode {
  account: Account;
  children?: AccountTreeNode[];
}

function findParentCode(code: string, codeSet: Set<string>): string | null {
  for (let len = code.length - 1; len >= 1; len -= 1) {
    const prefix = code.slice(0, len);
    if (codeSet.has(prefix)) return prefix;
  }
  return null;
}

function finalizeTreeNodes(nodes: AccountTreeNode[]) {
  for (const node of nodes) {
    if (node.children?.length) {
      finalizeTreeNodes(node.children);
      node.isLeaf = false;
    } else {
      delete node.children;
      node.isLeaf = true;
    }
  }
}

export function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  const codeSet = new Set(sorted.map((account) => account.code));
  const nodeMap = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  for (const account of sorted) {
    nodeMap.set(account.code, {
      key: account.id,
      title: `${account.code} ${account.name}`,
      account
    });
  }

  for (const account of sorted) {
    const node = nodeMap.get(account.code);
    if (!node) continue;
    const parentCode = findParentCode(account.code, codeSet);
    const parentNode = parentCode ? nodeMap.get(parentCode) : null;
    if (parentNode) {
      parentNode.children = parentNode.children || [];
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  finalizeTreeNodes(roots);
  return roots;
}

export function normalizeAccountTree(nodes: AccountTreeNode[]): AccountTreeNode[] {
  const cloned = nodes.map((node) => ({
    ...node,
    children: node.children ? normalizeAccountTree(node.children) : undefined
  }));
  finalizeTreeNodes(cloned);
  return cloned;
}

export function filterAccountTree(nodes: AccountTreeNode[], keyword: string): AccountTreeNode[] {
  const query = keyword.trim().toLowerCase();
  if (!query) return nodes;

  function walk(node: AccountTreeNode): AccountTreeNode | null {
    const text = `${node.account.code} ${node.account.name}`.toLowerCase();
    const childMatches = (node.children || [])
      .map(walk)
      .filter((item): item is AccountTreeNode => item !== null);
    if (text.includes(query) || childMatches.length) {
      return {
        ...node,
        children: childMatches.length ? childMatches : node.children
      };
    }
    return null;
  }

  return nodes.map(walk).filter((item): item is AccountTreeNode => item !== null);
}

export function collectAccountTreeKeys(nodes: AccountTreeNode[]): string[] {
  const keys: string[] = [];
  const visit = (items: AccountTreeNode[]) => {
    for (const node of items) {
      keys.push(String(node.key));
      if (node.children?.length) visit(node.children);
    }
  };
  visit(nodes);
  return keys;
}
