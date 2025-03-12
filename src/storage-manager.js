// storage-manager.js - 데이터 저장 담당
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

/**
 * 필요한 디렉토리 초기화
 */
function initDirectories() {
  // 데이터 디렉토리 생성
  fs.ensureDirSync(config.DATA_DIR);
  fs.ensureDirSync(path.join(config.DATA_DIR, 'items'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta', 'set_bonus'));
}

/**
 * 특정 디렉토리 확인 및 생성
 * @param {string} dirPath - 생성할 디렉토리 경로 (DATA_DIR 기준)
 */
function ensureDir(dirPath) {
  const fullPath = path.join(config.DATA_DIR, dirPath);
  fs.ensureDirSync(fullPath);
  return fullPath;
}

/**
 * 카테고리 데이터 존재 여부 확인
 * @return {boolean} 카테고리 데이터 존재 여부
 */
function checkCategoriesExist() {
  const categoriesPath = path.join(config.DATA_DIR, 'categories.json');
  return fs.existsSync(categoriesPath);
}

/**
 * 파일명으로 사용할 수 없는 특수문자 처리
 * @param {string} id 원본 ID
 * @return {string} 파일명으로 사용 가능한 ID
 */
function sanitizeFileName(id) {
  // 파일 시스템에서 문제가 될 수 있는 특수 문자들을 대체
  return id.replace(/[\/\\:*?"<>|]/g, '_');
}

/**
 * 아이템 데이터 저장 (카테고리별)
 * @param {string} categoryId 카테고리 ID
 * @param {Array} items 아이템 목록
 */
function saveItemsData(categoryId, items) {
  // 파일명으로 사용할 수 없는 특수문자 처리
  const safeFileName = sanitizeFileName(categoryId);
  const filePath = path.join(config.DATA_DIR, 'items', `${safeFileName}.json`);
  
  const data = {
    updated: new Date().toISOString(),
    count: items.length,
    items: items
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`아이템 데이터 저장 완료: ${categoryId} (${items.length}개)`);
}

module.exports = {
  initDirectories,
  ensureDir,
  checkCategoriesExist,
  saveItemsData,
  sanitizeFileName
};
