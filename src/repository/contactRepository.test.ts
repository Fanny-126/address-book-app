import { describe, it, expect } from 'vitest';
import { DexieContactRepository } from '@/repository/contactRepository';
import type { ContactInput } from '@/types/contact';

/** 仓储层单元测试（A1 持久化 / A2 CRUD / A3 多联系方式 / A4 收藏 / A6 分组） */

const sample: ContactInput = {
  name: '林晚晴',
  isFavorite: false,
  methods: [
    { type: 'phone', label: '手机', value: '+8613800000000' },
    { type: 'phone', label: '公司', value: '010-12345678' },
    { type: 'email', label: '工作', value: 'wanqing@example.com' },
    { type: 'custom', label: '备用号', value: '001234' },
  ],
  note: '备注',
};

function makeRepo() {
  return new DexieContactRepository();
}

describe('联系人 CRUD 与持久化', () => {
  it('新增后可查询，刷新（重新打开仓储）后数据仍在', async () => {
    const repo = makeRepo();
    const created = await repo.create(sample);
    expect(created.id).toBeTruthy();
    expect(created.methods).toHaveLength(4);

    // 模拟“关闭并重新打开浏览器”：重建仓储实例，从同一 IndexedDB 读取
    const repo2 = makeRepo();
    const found = await repo2.get(created.id);
    expect(found?.name).toBe('林晚晴');
    expect(found?.methods.map((m) => m.value)).toEqual([
      '+8613800000000',
      '010-12345678',
      'wanqing@example.com',
      '001234',
    ]);
  });

  it('每条联系方式有独立 id，order 保持录入顺序', async () => {
    const repo = makeRepo();
    const c = await repo.create(sample);
    const ids = c.methods.map((m) => m.id);
    expect(new Set(ids).size).toBe(4);
    expect(c.methods.map((m) => m.order)).toEqual([0, 1, 2, 3]);
  });

  it('电话按字符串原样保留（+、前导零、连字符）', async () => {
    const repo = makeRepo();
    const c = await repo.create({
      name: '号码测试',
      methods: [
        { type: 'phone', label: '手机', value: '+8613800000000' },
        { type: 'phone', label: '住宅', value: '010-12345678' },
        { type: 'phone', label: '其他', value: '001234' },
      ],
    });
    expect(c.methods.map((m) => m.value)).toEqual(['+8613800000000', '010-12345678', '001234']);
  });

  it('createdAt 创建后不变，updatedAt 编辑后更新', async () => {
    const repo = makeRepo();
    const c = await repo.create(sample);
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.update(c.id, { note: '改过的备注' });
    expect(updated.createdAt).toBe(c.createdAt);
    expect(updated.updatedAt > c.updatedAt).toBe(true);
    expect(updated.note).toBe('改过的备注');
  });

  it('删除后刷新不再出现；空库为空数组不报错', async () => {
    const repo = makeRepo();
    expect(await repo.list()).toEqual([]);
    const c = await repo.create(sample);
    await repo.delete(c.id);
    const repo2 = makeRepo();
    expect(await repo2.get(c.id)).toBeUndefined();
    expect(await repo2.list()).toEqual([]);
  });

  it('编辑只影响目标联系人', async () => {
    const repo = makeRepo();
    const a = await repo.create({ name: '甲' });
    const b = await repo.create({ name: '乙' });
    await repo.update(a.id, { name: '甲改' });
    expect((await repo.get(b.id))?.name).toBe('乙');
  });

  it('数据变更通知：写操作后订阅者被调用', async () => {
    const repo = makeRepo();
    let hits = 0;
    const unsub = repo.subscribe(() => hits++);
    await repo.create({ name: '通知测试' });
    expect(hits).toBe(1);
    unsub();
    await repo.create({ name: '通知测试2' });
    expect(hits).toBe(1); // 退订后不再通知
  });
});

describe('输入校验', () => {
  it('空姓名 / 纯空格姓名被拒绝', async () => {
    const repo = makeRepo();
    await expect(repo.create({ name: '   ' })).rejects.toThrow('姓名不能为空');
  });

  it('非法邮箱被拒绝，合法邮箱通过', async () => {
    const repo = makeRepo();
    await expect(
      repo.create({ name: 'A', methods: [{ type: 'email', label: '工作', value: 'not-an-email' }] }),
    ).rejects.toThrow('邮箱格式不正确');
    await expect(
      repo.create({ name: 'A', methods: [{ type: 'email', label: '工作', value: 'a+b@example.co' }] }),
    ).resolves.toBeTruthy();
  });

  it('自定义类型标签为空不能保存', async () => {
    const repo = makeRepo();
    await expect(
      repo.create({ name: 'A', methods: [{ type: 'custom', label: '  ', value: 'xxx' }] }),
    ).rejects.toThrow('自定义标签不能为空');
  });
});

describe('bulkCreate 事务性批量写入', () => {
  it('全部合法时整批写入', async () => {
    const repo = makeRepo();
    const created = await repo.bulkCreate([{ name: '批1' }, { name: '批2' }, { name: '批3' }]);
    expect(created).toHaveLength(3);
    expect(await repo.list()).toHaveLength(3);
  });

  it('任一记录非法则整批回滚，不产生部分脏数据', async () => {
    const repo = makeRepo();
    await expect(
      repo.bulkCreate([{ name: '合法' }, { name: '  ' }, { name: '也合法' }]),
    ).rejects.toThrow();
    expect(await repo.list()).toHaveLength(0);
  });
});

describe('收藏', () => {
  it('一键切换收藏，且不影响联系方式（id 与顺序保持不变）', async () => {
    const repo = makeRepo();
    const c = await repo.create(sample);
    const beforeIds = c.methods.map((m) => m.id);
    const toggled = await repo.update(c.id, { isFavorite: true });
    expect(toggled.isFavorite).toBe(true);
    expect(toggled.methods.map((m) => m.id)).toEqual(beforeIds);

    const list = await repo.list();
    expect(list.filter((x) => x.isFavorite).map((x) => x.id)).toEqual([c.id]);
  });
});

describe('分组', () => {
  it('新建 / 重命名 / 空名与重名拒绝', async () => {
    const repo = makeRepo();
    const g = await repo.createGroup('  同事  ');
    expect(g.name).toBe('同事');
    await expect(repo.createGroup('同事')).rejects.toThrow('已存在');
    await expect(repo.createGroup('   ')).rejects.toThrow('不能为空');
    const renamed = await repo.renameGroup(g.id, '朋友');
    expect(renamed.name).toBe('朋友');
  });

  it('删除分组不删联系人，并清理联系人上的 groupId', async () => {
    const repo = makeRepo();
    const g = await repo.createGroup('临时组');
    const c = await repo.create({ ...sample, groupIds: [g.id] });
    await repo.deleteGroup(g.id);
    const after = await repo.get(c.id);
    expect(after).toBeTruthy();
    expect(after?.groupIds).toEqual([]);
    expect(await repo.listGroups()).toEqual([]);
  });
});
