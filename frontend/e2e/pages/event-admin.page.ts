import type { Page } from '@playwright/test';
import { ToastPageObject } from './components/toast.po';
import { ModalPageObject } from './components/modal.po';

export class EventAdminPage {
  readonly toast: ToastPageObject;
  readonly modal: ModalPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
    this.modal = new ModalPageObject(page);
  }

  async goto(eventId: string) {
    await this.page.goto(`/event/${eventId}`);
  }

  get editButton() {
    return this.page.locator('[data-testid="edit-event-button"]');
  }

  get toggleStatus() {
    return this.page.locator('[data-testid="toggle-event-status"]');
  }

  get shareButton() {
    return this.page.locator('[data-testid="share-event-button"]');
  }

  get giftNameInput() {
    return this.page.locator('[data-testid="gift-name-input"]');
  }

  get addGiftButton() {
    return this.page.locator('[data-testid="add-gift-button"]');
  }

  get saveChangesButton() {
    return this.page.locator('[data-testid="save-event-changes"]');
  }

  get closeEditModalButton() {
    return this.page.locator('[data-testid="close-edit-modal"]');
  }

  async addGift(name: string) {
    await this.giftNameInput.fill(name);
    await this.addGiftButton.click();
  }

  async editTitle(newTitle: string) {
    await this.editButton.click();
    await this.page.fill('#edit-title', newTitle);
    await this.saveChangesButton.click();
  }
}
