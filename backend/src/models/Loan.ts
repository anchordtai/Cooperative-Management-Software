import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from './Cooperative';
import Member from './Member';

class Loan extends Model {
  public id!: string;
  declare cooperativeId: string | null;
  declare requestedBy: string | null;
  declare decidedBy: string | null;
  public memberId!: string;
  public amount!: number;
  public purpose!: string;
  public interestRate!: number;
  public term!: number;
  public startDate!: Date;
  public endDate!: Date;
  public status!: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  public remainingBalance!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Loan.init(
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
    decidedBy: { type: DataTypes.UUID },
    memberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Member,
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    term: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Loan term in months',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'active', 'completed'),
      defaultValue: 'pending',
    },
    remainingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Loan',
  }
);

// Define associations
Loan.belongsTo(Member, { foreignKey: 'memberId' });
Member.hasMany(Loan, { foreignKey: 'memberId' });

export default Loan; 