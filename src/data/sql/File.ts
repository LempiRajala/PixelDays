import { DataTypes, type Sequelize } from "sequelize";
import sequelize from "./sequelize";

export const File = (sequelize as Sequelize).define('File', {
  id: {
    type: `${DataTypes.UUID} CHARSET ascii COLLATE ascii_bin`,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  mimetype: {
    type: `${DataTypes.STRING(127)} CHARSET ascii COLLATE ascii_general_ci`,
    allowNull: false
  },
  name: {
    type: `${DataTypes.STRING(255)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false
  },
  hash: {
    type: `${DataTypes.CHAR(64)} CHARSET ascii COLLATE ascii_bin`,
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-f0-9]{64}$/i
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
});