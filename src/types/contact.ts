/**
 * 数据模型与仓储接口（成员 A 负责，A0 冻结接口）
 *
 * 与成员 B 约定：
 * - B 的 Excel 导入只调用 bulkCreate()，不直接操作 IndexedDB；
 * - B 的 Excel 导出只通过 list() 读取数据；
 * - 所有异步方法 reject 时抛出带中文 message 的 Error；
 * - 字段含义见各属性注释，双方确认后不再变更。
 */

/** 联系方式类型：电话 / 邮箱 / 社交账号 / 地址 / 自定义 */
export type ContactMethodType = 'phone' | 'email' | 'social' | 'address' | 'custom';

export interface ContactMethod {
  /** 稳定唯一 ID（UUID），删除中间条目不影响其他条目 */
  id: string;
  type: ContactMethodType;
  /** 类型标签，如「手机」「公司」；custom 类型为用户自定义标签，必填 */
  label: string;
  /** 原始内容。电话按字符串保存，保留 +、前导零、空格、分机号 */
  value: string;
  /** 录入顺序，导出明细表时按此顺序输出 */
  order: number;
}

export interface Contact {
  id: string;
  name: string;
  /** 收藏标识。Excel 导入时「是」→ true */
  isFavorite: boolean;
  /** 所属分组 ID 列表，一个联系人可属于多个分组 */
  groupIds: string[];
  /** 多种联系方式，动态数组，条数不限 */
  methods: ContactMethod[];
  note: string;
  /** ISO 时间串，创建后不再变化 */
  createdAt: string;
  /** ISO 时间串，每次成功更新后刷新 */
  updatedAt: string;
}

export interface Group {
  id: string;
  /** 分组名，保存前去除首尾空格，不允许为空 */
  name: string;
  createdAt: string;
}

/** 新建联系人入参（无 id / 时间戳，由仓储生成） */
export interface ContactInput {
  name: string;
  isFavorite?: boolean;
  groupIds?: string[];
  methods?: Array<{
    type: ContactMethodType;
    label: string;
    value: string;
  }>;
  note?: string;
}

/** 更新联系人入参（部分字段） */
export type ContactPatch = Partial<ContactInput>;

/**
 * 统一仓储接口。UI 层与 Excel 层只依赖本接口，不感知底层存储。
 */
export interface ContactRepository {
  list(): Promise<Contact[]>;
  get(id: string): Promise<Contact | undefined>;
  create(input: ContactInput): Promise<Contact>;
  update(id: string, patch: ContactPatch): Promise<Contact>;
  delete(id: string): Promise<void>;
  /**
   * 事务性批量写入（供 B 的 Excel 导入使用）：
   * 任一记录校验失败则整批回滚，不产生部分脏数据。
   */
  bulkCreate(contacts: ContactInput[]): Promise<Contact[]>;

  listGroups(): Promise<Group[]>;
  createGroup(name: string): Promise<Group>;
  renameGroup(id: string, name: string): Promise<Group>;
  /** 删除分组仅移除分组本身并清理联系人上的 groupIds，不删除联系人 */
  deleteGroup(id: string): Promise<void>;

  /** 数据变更通知：任何写操作完成后触发；返回取消订阅函数 */
  subscribe(listener: () => void): () => void;
}
