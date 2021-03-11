# 存储文件格式

## header

| field        | length |
| ------------ | ------ |
| magic number | 32     |
| version      | 32     |
| checksum     | 32     |
| count        | 32     |

### section header

| field     | length |
| --------- | ------ |
| checksum  | 32     |
| id        | 32     |
| fid       | 32     |
| offset    | 32     |
| size      | 16     |
| hash      | 128    |
| timestamp | 64     |
