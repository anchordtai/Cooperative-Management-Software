import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Member from './Member';

class Transaction extends Model {
  public id!: string;
  public memberId!: string;
  public type!: 'deposit' | 'withdrawal' | 'loan' | 'repayment';
  public amount!: number;
  public description!: string;
  public status!: 'pending' | 'completed' | 'failed';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    memberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Member,
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal', 'loan', 'repayment'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      defaultValue: 'pending',
    },
  },
  {
    sequelize,
    modelName: 'Transaction',
  }
);

// Define associations
Transaction.belongsTo(Member, { foreignKey: 'memberId' });
Member.hasMany(Transaction, { foreignKey: 'memberId' });

export default Transaction; 