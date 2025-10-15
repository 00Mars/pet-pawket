PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE `pets` (`id` TEXT not null, `userId` TEXT not null, `name` TEXT not null, `type` TEXT null, `breed` TEXT null, `birthday` TEXT null, `mood` TEXT null default 'Happy', `persona` TEXT null default 'Unset', `avatar` TEXT null, primary key (`id`));
CREATE TABLE IF NOT EXISTS "userss"(
  id TEXT,
  email TEXT,
  passwordHash TEXT,
  shopifyLinked INT,
  wishlist TEXT,
  preferences TEXT,
  pets TEXT,
  achievements TEXT,
  progress TEXT,
  activityLog TEXT,
  hueyMemory TEXT,
  memorials TEXT
);
INSERT INTO userss VALUES('user_1104084210','jon.bonin@gmail.com','$2b$10$R/YIQM5MCOPwIk.SACdF7OUJr0YK71rEC53m05Y42NZIxocvnHfXy',0,'[]','{"theme":"light","showActivityFeed":true}','[{"name":"Charlie","type":"Dog","breed":"Cavalier","birthday":"2024-04-30","mood":"Excited","persona":"Explorer","avatar":"/uploads/avatars/1747616820035_5035.jpeg","badges":[],"journal":[{"date":"May 22, 2025, 12:20 PM","displayDate":"","note":"time","mood":"Happy","tags":[],"photo":null,"highlighted":false},{"date":"May 21, 2025, 1:33 PM","displayDate":"","note":"Excited","mood":"Excited","tags":["#excited"],"photo":null,"highlighted":false},{"date":"May 21, 2025, 1:19 PM","displayDate":"","note":"try again","mood":"Happy","tags":["#cute"],"photo":"/uploads/journal/1747847956960_7998.jpeg","highlighted":false},{"date":"May 21, 2025, 1:17 PM","displayDate":"","note":"Try again time","mood":"Happy","tags":[],"photo":null,"highlighted":false},{"date":"May 21, 2025, 1:03 PM","displayDate":"","note":"data entries now work.","mood":"Happy","tags":[],"photo":null,"highlighted":false},{"date":"May 21, 2025, 1:02 PM","displayDate":"May 18, 2025, 5:02 PM","note":"FINALLY!!!!","mood":"Anxious","tags":["fun","love","happy"],"photo":null,"highlighted":false}]},{"name":"Hela","type":"Dog","breed":"Catahoula","birthday":"2023-11-12","mood":"Anxious","persona":"Cuddler","avatar":"/uploads/avatars/1747616829640_57.jpeg","badges":[],"journal":[{"date":"May 19, 2025, 8:00 PM","displayDate":"","note":"?","mood":"Happy","tags":[],"photo":null,"highlighted":false},{"date":"May 19, 2025, 8:00 PM","displayDate":"","note":"ok","mood":"Happy","tags":[],"photo":null,"highlighted":false},{"date":"May 18, 2025, 8:00 PM","displayDate":"May 22, 2025, 8:00PM","note":"Journal edit?","mood":"Happy","tags":["happy"],"photo":null,"highlighted":false}]},{"name":"Hunny","type":"Dog","breed":"Cavalier","birthday":"2024-04-30","mood":"Excited","persona":"Explorer","avatar":"/uploads/avatars/1747616838200_4769.jpeg","badges":[],"journal":[]},{"name":"Hera","type":"Reptile","breed":"Bearded Dragon","birthday":"","mood":"Sleepy","persona":"Explorer","avatar":"","badges":[],"journal":[]}]','[]','{"profile":0,"pets":0,"orders":0}','[]','[]','[{"name":"Charm","type":"Dog","years":"2009–2024","tribute":"The spark that started it all ❤️"}]');
COMMIT;
