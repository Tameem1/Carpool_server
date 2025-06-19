import bcrypt from 'bcryptjs';

async function testAuth() {
  // Get the actual password hash from database
  const dbPassword = '$2b$12$OgBCila8Pafc6c31ijaKH.ppFHwUw71ElZGv6rJBLs1ZYtElTisIa';
  
  console.log('Testing common passwords for user تميم...');
  
  const commonPasswords = [
    '123456', '654321', '000000', '111111', '222222', '333333', '444444', '555555',
    '666666', '777777', '888888', '999999', '12345', '54321', '123', '321',
    '1234', '4321', '12345678', '87654321', 'password', 'admin', '1111', '2222',
    '3333', '4444', '5555', '6666', '7777', '8888', '9999', '0000'
  ];
  
  for (const password of commonPasswords) {
    try {
      const isValid = await bcrypt.compare(password, dbPassword);
      if (isValid) {
        console.log(`✅ Found matching password: "${password}"`);
        return password;
      }
    } catch (error) {
      console.log(`Error testing password "${password}":`, error.message);
    }
  }
  
  console.log('❌ No matching password found in common list');
  return null;
}

testAuth().then(() => process.exit(0)).catch(console.error);