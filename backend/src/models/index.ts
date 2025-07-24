import { User } from './User';
import Member from './Member';
import Transaction from './Transaction';
import Loan from './Loan';

// Define associations
User.hasOne(Member, { foreignKey: 'userId' });
Member.belongsTo(User, { foreignKey: 'userId' });

Member.hasMany(Transaction, { foreignKey: 'memberId' });
Transaction.belongsTo(Member, { foreignKey: 'memberId' });

Member.hasMany(Loan, { foreignKey: 'memberId' });
Loan.belongsTo(Member, { foreignKey: 'memberId' });

export {
  User,
  Member,
  Transaction,
  Loan,
}; 