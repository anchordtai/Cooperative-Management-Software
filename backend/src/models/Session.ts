import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { User } from './User';

export default class Session extends Model {
  declare id: string;
  declare userId: string;
  declare refreshHash: string;
  declare expiresAt: Date;
}

Session.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' }, onDelete: 'CASCADE' },
  refreshHash: { type: DataTypes.STRING, allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false }
}, { sequelize, modelName: 'Session', indexes: [{ fields: ['userId'] }] });
