module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'isEmailVerified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('Users', 'emailVerificationToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'isPhoneVerified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('Users', 'phone', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn('Users', 'phoneVerificationCode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'twoFAEnabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('Users', 'twoFAMethod', {
      type: Sequelize.ENUM('email', 'sms'),
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'twoFACode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'twoFACodeExpires', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'isEmailVerified');
    await queryInterface.removeColumn('Users', 'emailVerificationToken');
    await queryInterface.removeColumn('Users', 'isPhoneVerified');
    await queryInterface.removeColumn('Users', 'phone');
    await queryInterface.removeColumn('Users', 'phoneVerificationCode');
    await queryInterface.removeColumn('Users', 'twoFAEnabled');
    await queryInterface.removeColumn('Users', 'twoFAMethod');
    await queryInterface.removeColumn('Users', 'twoFACode');
    await queryInterface.removeColumn('Users', 'twoFACodeExpires');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_twoFAMethod";');
  },
}; 