import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

class User extends Model {
  public id!: string;
  public email!: string;
  public password!: string;
  public role!: string;
  public firstName!: string;
  public lastName!: string;
  public isEmailVerified!: boolean;
  public emailVerificationToken!: string | null;
  public isPhoneVerified!: boolean;
  public phone!: string;
  public phoneVerificationCode!: string | null;
  public twoFAEnabled!: boolean;
  public twoFAMethod!: 'email' | 'sms' | null;
  public twoFACode!: string | null;
  public twoFACodeExpires!: Date | null;
  public passwordResetToken!: string | null;
  public passwordResetExpires!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('admin', 'member', 'staff'),
      defaultValue: 'member',
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isPhoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneVerificationCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twoFAEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    twoFAMethod: {
      type: DataTypes.ENUM('email', 'sms'),
      allowNull: true,
    },
    twoFACode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twoFACodeExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export { User }; 