import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export default class Cooperative extends Model {
  declare id: string;
  declare name: string;
  declare suspendedAt: Date | null;
  declare settings: Record<string, unknown>;
}

Cooperative.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  suspendedAt: { type: DataTypes.DATE, allowNull: true },
  settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, { sequelize, modelName: 'Cooperative' });
