import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { db } from '@/db/database';

// 每个用例前清空数据库：测试不依赖本机既有数据，结束后无残留
beforeEach(async () => {
  await db.contacts.clear();
  await db.groups.clear();
});
