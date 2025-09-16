/**
 * 日期时间工具函数
 * 本模块提供日期和时间操作的辅助函数，统一应用中的时间处理方式
 */

/**
 * 获取当前时间的UNIX时间戳（秒）
 * @returns {number} UNIX时间戳（秒）
 */
export function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000)
}

/**
 * 转换可能的日期格式为时间戳（秒）
 * 用于规范化不同类型的输入为一致的时间戳格式
 * @param {Date|number|string} date - 日期对象、时间戳（秒或毫秒）或ISO字符串
 * @returns {number|null} UNIX时间戳（秒），如果输入为空则返回null
 */
export function toTimestamp(date) {
  if (!date) return null

  // 如果已经是数字，检查是毫秒还是秒时间戳
  if (typeof date === 'number') {
    // 如果数字太大，假设是毫秒时间戳
    return date > 9999999999 ? Math.floor(date / 1000) : date
  }

  // 如果是Date对象
  if (date instanceof Date) {
    return Math.floor(date.getTime() / 1000)
  }

  // 如果是字符串，尝试解析
  if (typeof date === 'string') {
    const parsed = new Date(date)
    if (!isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000)
    }
  }

  // 无法解析则返回null
  return null
}

/**
 * 获取当前时间的ISO 8601字符串
 * @returns {string} ISO 8601格式的日期时间字符串
 */
export function getCurrentISOString() {
  return new Date().toISOString()
}

/**
 * 将时间戳（秒）转换为Date对象
 * @param {number} timestamp - UNIX时间戳（秒）
 * @returns {Date} Date对象
 */
export function timestampToDate(timestamp) {
  if (!timestamp) return null
  return new Date(timestamp * 1000)
}

/**
 * 将时间戳（秒）转换为ISO 8601字符串
 * @param {number} timestamp - UNIX时间戳（秒）
 * @returns {string|null} ISO 8601格式的日期时间字符串，如果输入为空则返回null
 */
export function timestampToISOString(timestamp) {
  if (!timestamp) return null
  return timestampToDate(timestamp).toISOString()
}

/**
 * 将ISO 8601字符串转换为时间戳（秒）
 * @param {string} isoString - ISO 8601格式的日期时间字符串
 * @returns {number|null} UNIX时间戳（秒），如果输入为空则返回null
 */
export function isoStringToTimestamp(isoString) {
  if (!isoString) return null
  return Math.floor(new Date(isoString).getTime() / 1000)
}

/**
 * 格式化日期为YYYY-MM-DD格式
 * @param {Date|number|string} date - 日期对象、时间戳或ISO字符串
 * @returns {string} 格式化的日期字符串
 */
export function formatDate(date) {
  if (!date) return ''

  let dateObj
  if (date instanceof Date) {
    dateObj = date
  } else if (typeof date === 'number') {
    dateObj = timestampToDate(date)
  } else {
    dateObj = new Date(date)
  }

  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 格式化日期时间为YYYY-MM-DD HH:MM:SS格式
 * @param {Date|number|string} date - 日期对象、时间戳或ISO字符串
 * @returns {string} 格式化的日期时间字符串
 */
export function formatDateTime(date) {
  if (!date) return ''

  let dateObj
  if (date instanceof Date) {
    dateObj = date
  } else if (typeof date === 'number') {
    dateObj = timestampToDate(date)
  } else {
    dateObj = new Date(date)
  }

  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const seconds = String(dateObj.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 计算两个时间戳之间的差（秒）
 * @param {number} timestamp1 - 第一个时间戳（秒）
 * @param {number} timestamp2 - 第二个时间戳（秒）
 * @returns {number} 两个时间戳的差值（秒）
 */
export function timestampDiff(timestamp1, timestamp2) {
  return Math.abs(timestamp1 - timestamp2)
}

/**
 * 检查时间戳是否已过期
 * @param {number} timestamp - 要检查的时间戳（秒）
 * @returns {boolean} 如果时间戳早于当前时间，则返回true
 */
export function isExpired(timestamp) {
  if (!timestamp) return false // 如果没有时间戳（例如null或0），视为永不过期
  return getCurrentTimestamp() > timestamp
}

/**
 * 向未来添加指定秒数
 * @param {number} seconds - 要添加的秒数
 * @param {number} [fromTimestamp] - 起始时间戳，默认为当前时间
 * @returns {number} 结果时间戳（秒）
 */
export function addSeconds(seconds, fromTimestamp = getCurrentTimestamp()) {
  return fromTimestamp + seconds
}

/**
 * 向未来添加指定分钟数
 * @param {number} minutes - 要添加的分钟数
 * @param {number} [fromTimestamp] - 起始时间戳，默认为当前时间
 * @returns {number} 结果时间戳（秒）
 */
export function addMinutes(minutes, fromTimestamp = getCurrentTimestamp()) {
  return addSeconds(minutes * 60, fromTimestamp)
}

/**
 * 向未来添加指定小时数
 * @param {number} hours - 要添加的小时数
 * @param {number} [fromTimestamp] - 起始时间戳，默认为当前时间
 * @returns {number} 结果时间戳（秒）
 */
export function addHours(hours, fromTimestamp = getCurrentTimestamp()) {
  return addSeconds(hours * 3600, fromTimestamp)
}

/**
 * 向未来添加指定天数
 * @param {number} days - 要添加的天数
 * @param {number} [fromTimestamp] - 起始时间戳，默认为当前时间
 * @returns {number} 结果时间戳（秒）
 */
export function addDays(days, fromTimestamp = getCurrentTimestamp()) {
  return addSeconds(days * 86400, fromTimestamp)
}
