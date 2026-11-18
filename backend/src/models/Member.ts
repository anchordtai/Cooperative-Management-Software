import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from './Cooperative';
import { User } from './User';

class Member extends Model {
  public id!: string;
  declare cooperativeId: string | null;
  declare userId: string | null;
  declare email: string;
  public membershipNumber!: string;
  public firstName!: string;
  public lastName!: string;
  public phone!: string;
  public address!: string;
  public dateOfBirth!: Date;
  public joinDate!: Date;
  public status!: 'active' | 'inactive' | 'suspended';
  public shareCapital!: number;
  public savings!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Member.init(
  {
    cooperativeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Cooperative, key: 'id' },
    },
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
    },
    membershipNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    joinDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
    shareCapital: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    savings: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'Member',
  }
);

// Define associations
Member.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Member, { foreignKey: 'userId' });

export default Member; 