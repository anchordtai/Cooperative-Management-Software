import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from './Cooperative';
import Member from './Member';

class Transaction extends Model {
  public id!: string;
  declare cooperativeId: string | null;
  declare requestedBy: string | null;
  declare handledBy: string | null;
  declare loanId: string | null;
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
    requestedBy: { type: DataTypes.UUID },
    handledBy: { type: DataTypes.UUID },
    loanId: { type: DataTypes.UUID },
    externalReference: { type: DataTypes.STRING(160) },
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